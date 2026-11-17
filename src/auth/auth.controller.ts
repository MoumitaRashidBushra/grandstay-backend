import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, AccountLockedException } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { validatedBody } from './validated-body.pipe.js';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('auth') //defines the controller's route prefix.
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body(validatedBody(RegisterDto)) dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body(validatedBody(LoginDto)) loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    //res: Response makes the response object available inside the entire method, including catch.
    try {
      const result = await this.authService.login(loginDto);

      // Store the refresh token in an HttpOnly cookie.
      res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);

      // Do not expose the raw refresh token in the JSON response.
      const { refreshToken, ...response } = result;

      return response;
    } catch (error: unknown) {
      //error: unknown: safer than using any
      if (error instanceof AccountLockedException) {
        //instanceof AccountLockedException: checks whether the error is our custom account-lockout exception.
        res.setHeader('Retry-After', error.retryAfterSeconds.toString()); //Retry-After: tells the client how many seconds to wait before retrying.
      }

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    const result = await this.authService.refresh(refreshToken);

    // Replace the old cookie with the newly rotated refresh token.
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);

    return {
      accessToken: result.accessToken,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout') //Creates the logout POST endpoint.
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    //@Req() req:	Accesses the incoming HTTP request.
    //passthrough: true:	Allows NestJS to handle the response normally while setting response headers.
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    await this.authService.logout(refreshToken);
    //authService.logout():	Hashes the token and revokes the matching database record.

    // Clear the cookie using the same path and cookie settings.
    //res.clearCookie():	Removes the refresh-token cookie from the browser.
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    });

    return {
      message: 'Logged out successfully',
    };
  }
}
