<p align="center">
  <a href="https://nestjs.com/" target="_blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="110" alt="NestJS Logo" />
  </a>
</p>

<h1 align="center">🚀 UNIQUOTE API</h1>

<p align="center">
  API empresarial moderna, segura y escalable construida con <strong>NestJS</strong>, <strong>Prisma ORM</strong> y <strong>PostgreSQL</strong>.
</p>

<p align="center">
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-%23E0234E.svg?style=flat&logo=nestjs&logoColor=white" alt="NestJS"/></a>
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-%23336791.svg?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL"/></a>
  <a href="#"><img src="https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white" alt="Prisma"/></a>
  <a href="#"><img src="https://img.shields.io/badge/JWT-%23000000.svg?style=flat&logo=jsonwebtokens&logoColor=white" alt="JWT"/></a>
  <a href="#"><img src="https://img.shields.io/github/license/your-org/uniquote-api" alt="License"/></a>
</p>

---

## 📘 Descripción

**UNIQUOTE API** es un backend empresarial diseñado para la gestión de usuarios, roles y autenticación segura basada en JWT.

> Framework principal: **NestJS + Prisma + PostgreSQL**

---

## 🧱 Tecnologías

- ⚙️ NestJS
- 🗄️ PostgreSQL
- 🔗 Prisma ORM
- 🔐 JWT + Argon2
- 🧪 Swagger
- 🐳 Docker
- 📦 Pino Logger

---

## 📁 Estructura del Proyecto


---

## ⚙️ Instalación

```bash
git clone https://github.com/your-org/uniquote-api.git
cd uniquote-api
npm install

📦 Configuración de entorno

Crea un archivo .env en la raíz:

PORT=3000
DB_HOST=localhost
DB_PORT=5433
DB_USER=uniquote_user
DB_PASS=123456
DB_NAME=uniquote_db
DATABASE_URL="postgresql://uniquote_user:123456@localhost:5433/uniquote_db"
JWT_SECRET="unaClaveSuperSegura"

🐳 Docker (Base de datos)

Levanta el contenedor PostgreSQL:
docker compose up -d

🧩 Prisma
Generar cliente
npx prisma generate

Crear migraciones
npx prisma migrate dev --name init


🚀 Ejecutar el proyecto
# modo desarrollo
npm run start:dev


📦 Scripts útiles
# Compilar
npm run build

# Producción
npm run start:prod

# Pruebas
npm run test

# Pruebas end-to-end
npm run test:e2e

# Cobertura
npm run test:cov




