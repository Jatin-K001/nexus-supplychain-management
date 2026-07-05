"""§5.5 Critical Path Identification — standard CPM forward/backward pass over
the same dependency graph the cascade engine (§5.1) uses. Zero-slack nodes
are the critical path."""
from datetime import date
import networkx as nx
from .db import get_conn
from .cascade import _to_date


def compute_critical_path(project_id: str) -> dict:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                select s.id, s.phase_id, s.planned_start, s.planned_end, s.name
                from subphases s join phases p on p.id = s.phase_id
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
    finally:
        conn.close()

    graph = nx.DiGraph()
    graph.add_nodes_from(subphases.keys())
    for e in edges:
        graph.add_edge(e['predecessor_subphase_id'], e['successor_subphase_id'], lag=e['lag_days'])

    durations = {}
    for node_id, sub in subphases.items():
        ps, pe = _to_date(sub['planned_start']), _to_date(sub['planned_end'])
        durations[node_id] = (pe - ps).days if (ps and pe) else 1

    order = list(nx.topological_sort(graph))

    # forward pass: earliest start/finish
    earliest_start, earliest_finish = {}, {}
    for node_id in order:
        es = 0
        for pred in graph.predecessors(node_id):
            es = max(es, earliest_finish[pred] + graph[pred][node_id]['lag'])
        earliest_start[node_id] = es
        earliest_finish[node_id] = es + durations[node_id]

    project_duration = max(earliest_finish.values()) if earliest_finish else 0

    # backward pass: latest start/finish
    latest_finish, latest_start = {}, {}
    for node_id in reversed(order):
        successors = list(graph.successors(node_id))
        if not successors:
            lf = project_duration
        else:
            lf = min(latest_start[s] - graph[node_id][s]['lag'] for s in successors)
        latest_finish[node_id] = lf
        latest_start[node_id] = lf - durations[node_id]

    critical_ids = []
    slack_by_id = {}
    for node_id in order:
        slack = latest_start[node_id] - earliest_start[node_id]
        slack_by_id[node_id] = slack
        if slack == 0:
            critical_ids.append(node_id)

    return {
        'project_id': project_id,
        'project_duration_days': project_duration,
        'critical_subphase_ids': critical_ids,
        'slack_by_subphase': slack_by_id,
    }
