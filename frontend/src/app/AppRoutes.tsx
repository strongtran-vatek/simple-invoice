import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { InvoiceListPage } from '../pages/InvoiceListPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AppLayout } from './AppLayout'

/** The route table, kept apart from the router so tests can mount it in memory. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Everything below needs a signed-in user. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/invoices" replace />} />
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
