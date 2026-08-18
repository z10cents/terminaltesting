# humanplane on Zo (local ops)

## Service
- Label: `polyterminal`
- Service ID: `svc_cEM3ajV_JNo`
- Live URL: `https://polyterminal-zmann.zocomputer.io`

## Build
```bash
cd /home/workspace/humanplane/backend
cargo build --release

cd /home/workspace/humanplane/frontend
npm ci
VITE_POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}" npm run build
```

## Redeploy
```bash
# Reuses existing service and restarts it
```

Use `tool update_user_service` with:
- `service_id`: `svc_cEM3ajV_JNo`
- `entrypoint`: `/home/workspace/humanplane/backend/target/release/polymarket-terminal`
- `workdir`: `/home/workspace/humanplane`
- `mode`: `http`
- `local_port`: `5173`
- `env_vars`:
  - `HOST=0.0.0.0`
  - `RUST_LOG=info`
  - `FRONTEND_DIST=/home/workspace/humanplane/frontend/dist`

## Smoke test
```bash
curl -fsS https://polyterminal-zmann.zocomputer.io/api/health
```
