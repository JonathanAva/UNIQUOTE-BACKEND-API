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

**UNIQUOTE API** es un backend empresarial diseñado para la gestión de usuarios, roles y autenticación segura basada en JWT.Implementa arquitectura modular, validaciones robustas, documentación con Swagger y seguridad empresarial.

> **Framework principal:** NestJS + Prisma + PostgreSQL

---

## 🧱 Tecnologías utilizadas

- ⚙️ **NestJS** — Framework modular para Node.js
- 🗄️ **PostgreSQL** — Base de datos relacional
- 🔗 **Prisma ORM** — ORM moderno y tipado
- 🔐 **JWT + Argon2** — Autenticación y cifrado
- 🧪 **Swagger** — Documentación interactiva
- 🐳 **Docker Compose** — Entornos reproducibles
- 📦 **Pino Logger** — Logging estructurado empresarial

---

## 📁 Estructura del Proyecto

```
src/
├── common/              # Utilidades, interceptores, pipes
├── config/              # Configuración global y validación de entorno
├── infra/               # PrismaService y conexión a base de datos
├── modules/
│   ├── auth/            # Autenticación y roles
│   ├── users/           # CRUD de usuarios
│   └── roles/           # CRUD de roles
└── main.ts              # Punto de entrada
```

---

## ⚙️ Instalación y configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/your-org/uniquote-api.git
cd uniquote-api
```

### 2. Instalar dependencias

```bash
npm install
```

---

## 📦 Configuración de entorno

Crea un archivo **.env** en la raíz del proyecto con las siguientes variables:

```env
# Parámetros de conexión a la base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5433
DB_USER=uniquote_user
DB_PASS=123456
DB_NAME=uniquote_db

# URL completa de conexión (usada por Prisma)
DATABASE_URL="postgresql://uniquote_user:123456@localhost:5433/uniquote_db"

# Puerto HTTP donde corre la API NestJS
PORT=3000

# Clave secreta para firmar JWT
JWT_SECRET="esomar@uniquote1291"

# Dirección de correo que se usará como remitente en los correos enviados
EMAIL_FROM="jonathan.villanueva1@catolica.edu.sv"

# Configuración de servidor SMTP (Gmail en este caso)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465           # 465 se usa comúnmente con SSL/TLS directo
SMTP_SECURE=true        # true indica uso de conexión segura

SMTP_USER="jonathan.villanueva1@catolica.edu.sv"
SMTP_PASS="wxeyxgzylkxapbsd"  # Contraseña de aplicación de Gmail

# Tiempo de vida del código MFA en minutos
MFA_CODE_TTL_MIN=10

# Cantidad de días que un dispositivo es considerado confiable (para no pedir MFA)
MFA_WINDOW_DAYS=29

```

---

## 🐳 Docker (Base de datos PostgreSQL)

### Levantar contenedor de PostgreSQL

```bash
docker compose up -d
```

> Verifica que el puerto 5433 no esté en uso. Si lo está, edita `docker-compose.yml`.

---

## 🧩 Prisma ORM

### Generar el cliente Prisma

```bash
npx prisma generate
```

### Crear migración inicial

```bash
npx prisma migrate dev --name init
```

### (Opcional) Acceder a la base de datos vía navegador

```bash
npx prisma studio
```

---

## 🚀 Ejecutar el proyecto

### Modo desarrollo

```bash
npm run start:dev
```

### Modo producción

```bash
npm run build
npm run start:prod
```

---

## 📚 Documentación Swagger

Disponible automáticamente en:

📘 [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## 🧪 Pruebas

```bash
# Pruebas unitarias
npm run test

# Pruebas end-to-end
npm run test:e2e

# Cobertura de pruebas
npm run test:cov
```

---

## 🔐 Seguridad implementada

- ✅ Contraseñas cifradas con **Argon2**
- ✅ Autenticación **JWT**
- ✅ Protección de rutas con **Guards**
- ✅ Validaciones con **class-validator + Joi**
- ✅ Swagger protegido con **BearerAuth**

---

## 🔑 Endpoints principales

### Auth `/auth`

| Método | Ruta            | Descripción                          |
| ------- | --------------- | ------------------------------------- |
| POST    | `/auth/login` | Inicia sesión y retorna un token JWT |

### Usuarios `/users`

| Método | Ruta           | Descripción               |
| ------- | -------------- | -------------------------- |
| POST    | `/users`     | Crear nuevo usuario        |
| GET     | `/users`     | Obtener todos los usuarios |
| GET     | `/users/:id` | Obtener usuario por ID     |
| PUT     | `/users/:id` | Actualizar usuario         |
| DELETE  | `/users/:id` | Eliminar usuario           |

### Roles `/roles`

| Método | Ruta           | Descripción            |
| ------- | -------------- | ----------------------- |
| POST    | `/roles`     | Crear nuevo rol         |
| GET     | `/roles`     | Obtener todos los roles |
| GET     | `/roles/:id` | Obtener rol por ID      |
| PATCH   | `/roles/:id` | Actualizar rol          |
| DELETE  | `/roles/:id` | Eliminar rol            |

---

## 🚀 Despliegue

### Opción 1: Docker Compose

```bash
docker compose up -d --build
```

### Opción 2: Despliegue manual (producción)

```bash
npm run build
npm run start:prod
```

---

## 📚 Recursos recomendados

- [NestJS](https://docs.nestjs.com)
- [Prisma ORM](https://www.prisma.io/docs)
- [Swagger](https://swagger.io/tools/swagger-ui/)
- [Docker](https://docs.docker.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [JWT](https://jwt.io/)

---

## Semillas

npx ts-node src/seeds/seed-constantes.ts
npx ts-node src/seeds/seed-roles.ts

---

## 📝 Licencia

Este proyecto está licenciado bajo la **MIT License**.

<p align="center">
  <strong>© 2025 UNIQUOTE Jonathan Villanueva Emilia Escobar</strong>
</p>
