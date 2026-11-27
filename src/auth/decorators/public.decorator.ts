import { SetMetadata } from '@nestjs/common';

// Metadata key used to identify public routes.
export const IS_PUBLIC_KEY = 'isPublic';

// Marks a route as public, so it does not require a JWT.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/*
Your JWT guard protects routes by default. However, some routes must remain accessible without logging in, such as:
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- GET /settings
- GET /categories
- GET /availability
- GET /health and GET /ready
The @Public() decorator marks these routes so the JWT guard can skip authentication for them, as required by the SRS API contract*/