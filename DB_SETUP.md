# FGD Local Postgres Setup

Status: Docker daemon not running (cannot reach `dockerDesktopLinuxEngine`). Start Docker Desktop, then run the commands below to launch Postgres with the predefined credentials.

## Credentials
- `POSTGRES_USER=fgd_admin`
- `POSTGRES_PASSWORD=fgd_admin_pass_!234`
- `POSTGRES_DB=fgd_aicraft`
- Exposed port: `5432`

## Start Postgres (Docker)
```sh
docker run -d --name fgd-postgres ^
  -e POSTGRES_USER=fgd_admin ^
  -e POSTGRES_PASSWORD=fgd_admin_pass_!234 ^
  -e POSTGRES_DB=fgd_aicraft ^
  -p 5432:5432 postgres:16-alpine
```
*(PowerShell users can paste as-is; Bash users remove the carets and join lines.)*

If the container already exists, start it:
```sh
docker start fgd-postgres
```

## Environment variables to add before `npm start`
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fgd_aicraft
DB_USER=fgd_admin
DB_PASSWORD=fgd_admin_pass_!234
ADMIN_API_KEY=dev-key
LLM_API_KEY=dev-llm
```

## Health check after start
- `psql -h localhost -U fgd_admin -d fgd_aicraft -c "SELECT NOW();"`
- `curl http://localhost:3000/api/health`
