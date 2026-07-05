"""§4.4 Auto-Generated Purchase Recommendations — bundles §4.1 (demand risk),
§4.2 (vendor reliability), §4.3 (price timing) into one recommended order the
moment a material is flagged at risk. Distinct from the reactive Stock
Request pipeline (§6): this path is proactive, triggered by the forecast
itself, and its purchase_orders rows carry no source_stock_request_id.

No LLM anywhere (§10) — the reasoning text is a plain rule-based template
over structured numbers, e.g. "Vendor A recommended — 88 reliability,
4-day lead time, price trending +22%".
"""
from datetime import date, timedelta
from .db import get_conn
from .price_forecast import forecast_price


def _reasoning(vendor_name, score, lead_days, pct_change, substitute_note=None):
    trend = f"price trending {'+' if pct_change >= 0 else ''}{pct_change}%"
    base = f"{vendor_name} recommended — {score} reliability, {lead_days}-day lead time, {trend}"
    if substitute_note:
        base += f". {substitute_note}"
    return base


def generate_recommendations() -> list[dict]:
    conn = get_conn()
    created = []
    try:
        with conn.cursor() as cur:
            # at-risk: predicted shortfall lands on/before the material's needed-by date
            cur.execute(
                """
                select df.project_id, df.material_id, df.predicted_shortfall_date, df.confidence_pct,
                       m.name as material_name
                from demand_forecasts df
                join materials m on m.id = df.material_id
                join subphase_materials sm on sm.material_id = df.material_id
                join subphases s on s.id = sm.subphase_id
                join phases p on p.id = s.phase_id and p.project_id = df.project_id
                where s.status != 'complete' and sm.required_by_date is not null
                  and df.predicted_shortfall_date <= sm.required_by_date
                group by df.project_id, df.material_id, df.predicted_shortfall_date, df.confidence_pct, m.name
                """
            )
            at_risk = cur.fetchall()

            for row in at_risk:
                project_id, material_id = row['project_id'], row['material_id']

                # skip if a proactive recommendation is already open for this pair
                cur.execute(
                    """
                    select id from purchase_orders
                    where project_id = %s and material_id = %s and source_stock_request_id is null
                      and status in ('recommended','approved','ordered')
                    """,
                    (project_id, material_id),
                )
                if cur.fetchone():
                    continue

                cur.execute(
                    """
                    select v.id, v.name, v.reliability_score, vm.avg_price
                    from vendor_materials vm join vendors v on v.id = vm.vendor_id
                    where vm.material_id = %s order by v.reliability_score desc limit 1
                    """,
                    (material_id,),
                )
                vendor = cur.fetchone()
                if not vendor:
                    continue  # no vendor supplies this material at all — nothing to recommend

                price = forecast_price(material_id)
                buy_now = bool(price.get('buy_now', False))
                pct_change = price.get('pct_change', 0)

                cur.execute(
                    """
                    select avg(actual_date - order_date)::float as avg_days, count(*)::int as n
                    from vendor_deliveries where vendor_id = %s and material_id = %s
                    """,
                    (vendor['id'], material_id),
                )
                lead = cur.fetchone()
                lead_days = round(lead['avg_days']) if lead['n'] else 4

                cur.execute(
                    """
                    select sm.quantity_required from subphase_materials sm
                    join subphases s on s.id = sm.subphase_id join phases p on p.id = s.phase_id
                    where p.project_id = %s and sm.material_id = %s and s.status != 'complete'
                    order by s.planned_start asc nulls last limit 1
                    """,
                    (project_id, material_id),
                )
                qty_row = cur.fetchone()
                quantity = float(qty_row['quantity_required']) if qty_row else 1.0

                # §4.10: surface a substitute as a secondary option when the
                # primary vendor can't beat the deadline even on rush timing
                cur.execute(
                    """
                    select m2.name, ms.note from material_substitutes ms
                    join materials m2 on m2.id = ms.substitute_material_id
                    where ms.material_id = %s limit 1
                    """,
                    (material_id,),
                )
                sub = cur.fetchone()
                substitute_note = None
                required_by = row['predicted_shortfall_date']
                projected_delivery = date.today() + timedelta(days=lead_days)
                if sub and projected_delivery > required_by:
                    substitute_note = f"Primary vendor may miss the deadline — {sub['name']} is an approved substitute"

                order_date = date.today() if buy_now else date.today() + timedelta(days=7)
                promised_date = order_date + timedelta(days=lead_days)
                reasoning = _reasoning(vendor['name'], vendor['reliability_score'], lead_days, pct_change, substitute_note)

                cur.execute(
                    """
                    insert into purchase_orders
                      (material_id, vendor_id, quantity, status, project_id, order_date, promised_date, notes)
                    values (%s,%s,%s,'recommended',%s,%s,%s,%s) returning id
                    """,
                    (material_id, vendor['id'], quantity, project_id, order_date, promised_date, reasoning),
                )
                po_id = cur.fetchone()['id']
                created.append({'purchase_order_id': po_id, 'material': row['material_name'], 'reasoning': reasoning})

        conn.commit()
        return created
    finally:
        conn.close()
