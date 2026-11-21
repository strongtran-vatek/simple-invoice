import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from '../auth/RequireAuth'
import { InvoiceCreatePage } from '../pages/InvoiceCreatePage'
import { InvoiceDetailPage } from '../pages/InvoiceDetailPage'
import { InvoiceListPage } from '../pages/InvoiceListPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AppLayout } from './AppLayout'
import { NotificationProvider } from './NotificationProvider'

/** The route table, kept apart from the router so tests can mount it in memory. */
export function AppRoutes() {
  return (
    // Above the routes, so a message survives the redirect that follows it.
    <NotificationProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Everything below needs a signed-in user. */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/invoices" replace />} />
            <Route path="/invoices" element={<InvoiceListPage />} />
            <Route path="/invoices/new" element={<InvoiceCreatePage />} />
            <Route
              path="/invoices/:invoiceId"
              element={<InvoiceDetailPage />}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </NotificationProvider>
  )
}
