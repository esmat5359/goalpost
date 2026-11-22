import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import { Loading } from './components/Bits';
import { Layout } from './components/Layout';
import { LedgerPage } from './pages/Ledger';

// The ledger is the landing page and ships in the first chunk. Every other page is fetched when it
// is first visited, so a visitor who only reads the ledger never downloads the registration form,
// the verifier or the docs.
const AuditPage = lazy(() => import('./pages/Audit').then((m) => ({ default: m.AuditPage })));
const DocsPage = lazy(() => import('./pages/Docs').then((m) => ({ default: m.DocsPage })));
const DriftPage = lazy(() => import('./pages/Drift').then((m) => ({ default: m.DriftPage })));
const HowPage = lazy(() => import('./pages/How').then((m) => ({ default: m.HowPage })));
const NotFoundPage = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFoundPage })));
const PledgePage = lazy(() => import('./pages/Pledge').then((m) => ({ default: m.PledgePage })));
const PublisherPage = lazy(() => import('./pages/Publisher').then((m) => ({ default: m.PublisherPage })));
const PublishersPage = lazy(() => import('./pages/Publishers').then((m) => ({ default: m.PublishersPage })));
const RegisterPage = lazy(() => import('./pages/Register').then((m) => ({ default: m.RegisterPage })));
const VerifyPage = lazy(() => import('./pages/Verify').then((m) => ({ default: m.VerifyPage })));

export function App() {
  return (
    <Suspense
      fallback={
        <div className="route-fallback">
          <Loading label="Loading" />
        </div>
      }
    >
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<LedgerPage />} />
          <Route path="new" element={<RegisterPage />} />
          <Route path="pledges/:pledgeId" element={<PledgePage />} />
          <Route path="pledges/:pledgeId/drift" element={<DriftPage />} />
          <Route path="audits/:auditId" element={<AuditPage />} />
          <Route path="publishers" element={<PublishersPage />} />
          <Route path="publishers/*" element={<PublisherPage />} />
          <Route path="verify" element={<VerifyPage />} />
          <Route path="verify/:auditId" element={<VerifyPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="how" element={<HowPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
