export const config = {
  databaseUrl: process.env.DATABASE_URL,
  port: Number(process.env.PORT || 4100),
  host: process.env.HOST || '127.0.0.1',
};
