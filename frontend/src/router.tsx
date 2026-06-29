import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { JobBoardPage }      from '@/features/jobs/pages/JobBoardPage'
import { JobDetailPage }     from '@/features/jobs/pages/JobDetailPage'
import { AlertHistoryPage }  from '@/features/alerts/pages/AlertHistoryPage'
import { ContactsPage }      from '@/features/contacts/pages/ContactsPage'
import { SchedulesPage }     from '@/features/schedules/pages/SchedulesPage'
import { SettingsPage }      from '@/features/settings/pages/SettingsPage'
import { AnalyticsPage }     from '@/features/analytics/pages/AnalyticsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true,              element: <JobBoardPage /> },
      { path: 'jobs/:id',         element: <JobDetailPage /> },
      { path: 'alerts',           element: <AlertHistoryPage /> },
      { path: 'alerts/:alertId',  element: <AlertHistoryPage /> },
      { path: 'schedules',        element: <SchedulesPage /> },
      { path: 'contacts',         element: <ContactsPage /> },
      { path: 'settings',         element: <SettingsPage /> },
      { path: 'analytics',        element: <AnalyticsPage /> },
    ],
  },
])
