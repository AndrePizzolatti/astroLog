import { router } from './trpc'
import { projectsRouter }                                      from './routers/projects'
import { sessionsRouter }                                      from './routers/sessions'
import { telescopeRouter, cameraRouter, mountRouter, accessoryRouter, setupRouter } from './routers/equipment'
import { weatherRouter }                                       from './routers/weather'
import { userRouter }                                          from './routers/user'

export const appRouter = router({
  user:        userRouter,
  projects:   projectsRouter,
  sessions:   sessionsRouter,
  telescopes:  telescopeRouter,
  cameras:     cameraRouter,
  mounts:      mountRouter,
  accessories: accessoryRouter,
  setups:      setupRouter,
  weather:    weatherRouter,
})

export type AppRouter = typeof appRouter
