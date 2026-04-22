# Wow Gift Go Server

This is the backend API server for the Wow Gift system, built with Go and the Gin framework.

## Project Structure

- `cmd/api/main.go`: Entry point for the API server.
- `internal/api/`: Handlers and middlewares for the HTTP API.
- `internal/app/services/`: Business logic layer.
- `internal/domain/`: Domain models and types.
- `internal/infra/`: Infrastructure layer (DB, external providers).
- `pkg/`: Reusable packages and utilities.
- `docs/`: API documentation (Swagger).

## How to Build

Use the PowerShell script to build the executable for Windows:

```powershell
./build-exe.ps1
```

## How to Run

Ensure you have a `.env` file in the root directory with the necessary configuration, then run:

```bash
./w-gift-api.exe
```

## Features

- User Authentication & Authorization (JWT)
- MFA Setup & Verification
- KYC Integration
- Product & Brand Management
- Shopping Cart & Order Processing
- Trade-in Requests
- Admin Management Interface
- Site Configuration Management
