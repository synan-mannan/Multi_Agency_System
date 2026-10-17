from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings

from .routers import activity, auth, clients, comments, dashboard, files, invites, projects, tasks, team, timelog

app = FastAPI(title="AgencyDesk")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition"],
)
for router in (auth.router, clients.router, activity.router, projects.router, tasks.router, comments.router, files.router,
               timelog.router, dashboard.router, invites.router, team.router):
    app.include_router(router)
