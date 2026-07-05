"""§4.1 LSTM Demand Forecasting — trained once offline on seed data, cached
predictions served from `demand_forecasts` (never retrained live per spec).

Framework note: the spec calls for TensorFlow/Keras, but TensorFlow has no
published wheel for this environment's Python (3.14 — released too recently
for TF to support yet). Using PyTorch instead: same architecture (single-layer
LSTM, 64 units) trained on 14-day rolling consumption sequences, same
input/output contract. Functionally equivalent substitution forced by the
runtime, not a scope cut.

Run this manually after seeding: python training/train_demand_lstm.py
"""
import sys
from pathlib import Path
from datetime import date, timedelta
import numpy as np
import torch
import torch.nn as nn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.db import get_conn  # noqa: E402

SEQ_LEN = 14
MIN_HISTORY_DAYS = SEQ_LEN + 1
FALLBACK_CONFIDENCE = 45.0


class DemandLSTM(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(input_size=1, hidden_size=64, num_layers=1, batch_first=True)
        self.head = nn.Linear(64, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out[:, -1, :])


def build_daily_series(rows, start, end):
    """Dense daily series (0-filled gaps) between start and end inclusive."""
    by_date = {r['log_date']: float(r['quantity']) for r in rows}
    n_days = (end - start).days + 1
    return [by_date.get(start + timedelta(days=i), 0.0) for i in range(n_days)]


def make_training_windows(series):
    X, y = [], []
    for i in range(len(series) - SEQ_LEN):
        X.append(series[i:i + SEQ_LEN])
        y.append(series[i + SEQ_LEN])
    return X, y


def train_model(all_windows_x, all_windows_y):
    X = torch.tensor(all_windows_x, dtype=torch.float32).unsqueeze(-1)  # (N, 14, 1)
    y = torch.tensor(all_windows_y, dtype=torch.float32).unsqueeze(-1)  # (N, 1)

    model = DemandLSTM()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = nn.MSELoss()

    model.train()
    for epoch in range(60):
        optimizer.zero_grad()
        pred = model(X)
        loss = loss_fn(pred, y)
        loss.backward()
        optimizer.step()
    print(f'Trained on {len(X)} sequences, final MSE loss: {loss.item():.4f}')
    return model


def predict_next_day_rate(model, last_14_days):
    model.eval()
    with torch.no_grad():
        x = torch.tensor([last_14_days], dtype=torch.float32).unsqueeze(-1)
        return max(0.0, float(model(x).item()))


def main():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute('select id, category from materials')
    materials = {m['id']: m['category'] for m in cur.fetchall()}

    cur.execute('select id, status from projects')
    projects = {p['id']: p['status'] for p in cur.fetchall()}

    cur.execute('select project_id, material_id, log_date, quantity from consumption_logs order by log_date')
    all_logs = cur.fetchall()

    grouped = {}
    for row in all_logs:
        key = (row['project_id'], row['material_id'])
        grouped.setdefault(key, []).append(row)

    # ---- category-level fallback rate (§4.1 fallback formula) ----
    category_totals = {}
    for row in all_logs:
        cat = materials.get(row['material_id'])
        category_totals.setdefault(cat, []).append(float(row['quantity']))
    category_avg_daily = {
        cat: (sum(qtys) / max(1, len(qtys))) for cat, qtys in category_totals.items()
    }

    # ---- build pooled training windows across every sufficiently-long series ----
    train_x, train_y = [], []
    eligible_pairs = []
    for (project_id, material_id), rows in grouped.items():
        dates = [r['log_date'] for r in rows]
        span_start, span_end = min(dates), max(dates)
        if (span_end - span_start).days + 1 < MIN_HISTORY_DAYS:
            continue
        series = build_daily_series(rows, span_start, span_end)
        wx, wy = make_training_windows(series)
        if wx:
            train_x.extend(wx)
            train_y.extend(wy)
            eligible_pairs.append((project_id, material_id, series))

    model = None
    if train_x:
        model = train_model(train_x, train_y)
    else:
        print('No pairs with enough history to train — every forecast will use the fallback path.')

    # ---- compute + cache one forecast row per (project, material) that's actually in use ----
    cur.execute(
        """
        select distinct sm.material_id, p.project_id
        from subphase_materials sm
        join subphases s on s.id = sm.subphase_id
        join phases p on p.id = s.phase_id
        """
    )
    all_pairs = [(r['project_id'], r['material_id']) for r in cur.fetchall()]

    cur.execute('truncate table demand_forecasts')

    today = date.today()
    inserted = 0
    for project_id, material_id in all_pairs:
        cur.execute(
            """
            select sm.quantity_in_stock, sm.required_by_date
            from subphase_materials sm
            join subphases s on s.id = sm.subphase_id
            join phases p on p.id = s.phase_id
            where p.project_id = %s and sm.material_id = %s and s.status != 'complete'
            order by s.planned_start asc nulls last
            limit 1
            """,
            (project_id, material_id),
        )
        upcoming = cur.fetchone()
        if not upcoming:
            continue
        stock_on_hand = float(upcoming['quantity_in_stock'])

        match = next((s for (pid, mid, s) in eligible_pairs if pid == project_id and mid == material_id), None)

        if match is not None and model is not None:
            rate = predict_next_day_rate(model, match[-SEQ_LEN:])
            is_fallback = rate <= 0
            confidence = 85.0
        else:
            rate = 0.0
            is_fallback = True
            confidence = FALLBACK_CONFIDENCE

        if is_fallback or rate <= 0:
            category = materials.get(material_id)
            rate = category_avg_daily.get(category, 0.0)
            is_fallback = True
            confidence = FALLBACK_CONFIDENCE

        if rate <= 0:
            continue  # no basis to project a shortfall date at all

        days_to_shortfall = stock_on_hand / rate
        shortfall_date = today + timedelta(days=round(days_to_shortfall))

        cur.execute(
            """
            insert into demand_forecasts (material_id, project_id, predicted_shortfall_date, confidence_pct, is_fallback)
            values (%s, %s, %s, %s, %s)
            """,
            (material_id, project_id, shortfall_date, confidence, is_fallback),
        )
        inserted += 1

    conn.commit()
    print(f'Cached {inserted} demand forecasts.')
    conn.close()


if __name__ == '__main__':
    main()
