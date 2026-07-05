import { Card, CardPad, CardTitle } from '../components/ui/Card';

// Stand-in content for routes task 12 builds out screen-by-screen against
// nexus_master_reference_1.html. Proves the shell/auth/routing/kit work
// end-to-end before the real screens land.
export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <div className="header-row">
        <div>
          <div className="section-title">{title}</div>
          <div className="section-sub">SCREEN PENDING — BUILD ORDER §12</div>
        </div>
      </div>
      <Card>
        <CardPad>
          <CardTitle>Coming up</CardTitle>
          <div style={{ fontFamily: 'var(--ff-body)', fontSize: 13, color: 'var(--text-2)' }}>
            This route is wired to real auth and role routing — the actual screen content is built next.
          </div>
        </CardPad>
      </Card>
    </div>
  );
}
