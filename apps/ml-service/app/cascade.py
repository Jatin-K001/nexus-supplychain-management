"""§5.1 Dependency-Graph Modeling + §5.2 Delay Cascade Tracing.

Builds a networkx DiGraph from phase_dependencies for one project, does a
topological forward pass recomputing projected end dates from any actual
delay, and writes the results back (§5.4 Completion-Date Impact Projection,
§5.8 Cost-of-Delay Estimator). Called by the Node API right after a subphase
ends late (§3.2) — never run standalone/manually.
"""
from datetime import date, timedelta
import networkx as nx
from .db import get_conn


def _to_date(v):
    if v is None:
        return None
    if isinstance(v, date):
        return v
    return date.fromisoformat(str(v))


def recalculate_cascade(project_id: str) -> dict:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                select s.id, s.phase_id, s.status, s.planned_start, s.planned_end,
                       s.actual_start, s.actual_end, p.template_phase_no
                from subphases s
                join phases p on p.id = s.phase_id
                where p.project_id = %s
                """,
                (project_id,),
            )
            subphases = {row['id']: row for row in cur.fetchall()}

            cur.execute(
                """
                select pd.predecessor_subphase_id, pd.successor_subphase_id, pd.lag_days
                from phase_dependencies pd
                join subphases s on s.id = pd.predecessor_subphase_id
                join phases p on p.id = s.phase_id
                where p.project_id = %s
                """,
                (project_id,),
            )
            edges = cur.fetchall()

        graph = nx.DiGraph()
        graph.add_nodes_from(subphases.keys())
        for e in edges:
            graph.add_edge(e['predecessor_subphase_id'], e['successor_subphase_id'], lag=e['lag_days'])

        order = list(nx.topological_sort(graph))
        new_start, new_end = {}, {}

        for node_id in order:
            sub = subphases[node_id]
            planned_start = _to_date(sub['planned_start'])
            planned_end = _to_date(sub['planned_end'])
            duration = (planned_end - planned_start).days if (planned_start and planned_end) else 2

            if sub['status'] == 'complete':
                actual_start = _to_date(sub['actual_start']) or planned_start
                actual_end = _to_date(sub['actual_end']) or planned_end
                new_start[node_id] = actual_start
                new_end[node_id] = actual_end
                continue

            candidate = planned_start or date.today()
            for pred_id in graph.predecessors(node_id):
                lag = graph[pred_id][node_id]['lag']
                pushed = new_end[pred_id] + timedelta(days=lag)
                if pushed > candidate:
                    candidate = pushed

            new_start[node_id] = candidate
            new_end[node_id] = candidate + timedelta(days=duration)

        affected_subphases = []
        with conn.cursor() as cur:
            for node_id, sub in subphases.items():
                planned_end = _to_date(sub['planned_end'])
                if sub['status'] != 'complete':
                    cur.execute(
                        'update subphases set projected_end = %s where id = %s',
                        (new_end[node_id], node_id),
                    )
                if planned_end and new_end[node_id] > planned_end:
                    affected_subphases.append(node_id)

            phase_projections: dict[str, date] = {}
            for node_id, sub in subphases.items():
                phase_id = sub['phase_id']
                phase_projections[phase_id] = max(phase_projections.get(phase_id, new_end[node_id]), new_end[node_id])

            affected_phases = []
            for phase_id, projected_end in phase_projections.items():
                cur.execute('update phases set projected_end = %s where id = %s', (projected_end, phase_id))
                cur.execute('select planned_end from phases where id = %s', (phase_id,))
                row = cur.fetchone()
                planned_end = _to_date(row['planned_end']) if row else None
                if planned_end and projected_end > planned_end:
                    affected_phases.append(phase_id)

            project_projected_end = max(phase_projections.values()) if phase_projections else None

            cur.execute('select target_end_date, daily_cost_estimate from projects where id = %s', (project_id,))
            proj = cur.fetchone()
            target_end = _to_date(proj['target_end_date'])
            delay_days = max(0, (project_projected_end - target_end).days) if (project_projected_end and target_end) else 0
            cost_of_delay = delay_days * float(proj['daily_cost_estimate'] or 0)

            cur.execute(
                'update projects set projected_end_date = %s where id = %s',
                (project_projected_end, project_id),
            )

        conn.commit()

        return {
            'project_id': project_id,
            'projected_end_date': project_projected_end.isoformat() if project_projected_end else None,
            'delay_days': delay_days,
            'cost_of_delay': cost_of_delay,
            'affected_phases': affected_phases,
            'affected_subphases': affected_subphases,
        }
    finally:
        conn.close()
