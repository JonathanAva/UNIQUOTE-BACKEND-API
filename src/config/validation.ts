import * as Joi from 'joi';

// Esquema de validación de variables de entorno.
// Si alguna requerida no está definida, la app no arranca.
export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  DATABASE_URL: Joi.string().required(),

  JWT_SECRET: Joi.string().required(),
});
