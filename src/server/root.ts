import { router } from './trpc'
import { projectsRouter }                                      from './routers/projects'
import { sessionsRouter }                                      from './routers/sessions'
import { telescopeRouter, cameraRouter, mountRouter, accessoryRouter, setupRouter } from './routers/equipment'
import { weatherRouter }                                       from './routers/weather'
import { userRouter }                                          from './routers/user'
import { alertsRouter }                                        from './routers/alerts'
import { calibrationRouter }                                   from './routers/calibration'

export const appRouter = router({
  user:        userRouter,
  projects:    projectsRouter,
  sessions:    sessionsRouter,
  telescopes:  telescopeRouter,
  cameras:     cameraRouter,
  mounts:      mountRouter,
  accessories: accessoryRouter,
  setups:      setupRouter,
  weather:     weatherRouter,
  alerts:      alertsRouter,
  calibration: calibrationRouter,
})

export type AppRouter = typeof appRouter
