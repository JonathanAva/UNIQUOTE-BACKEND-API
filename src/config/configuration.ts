// Configuración centralizada de la aplicación.
// Esta función se usa en ConfigModule.forRoot({ load: [configuration] })
export default () => ({
  // Puerto HTTP donde se levanta NestJS
  port: parseInt(process.env.PORT || '3000', 10),

  // Configuración de la base de datos (útil si quisieras NO usar DATABASE_URL)
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    name: process.env.DB_NAME,
    url: process.env.DATABASE_URL, // URL completa para Prisma
  },

  // Configuración del JWT
  jwt: {
    // Clave secreta para firmar tokens (se obtiene de variables de entorno)
    secret: process.env.JWT_SECRET,
  },
});
