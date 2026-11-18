import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, AccountLockedException} from '../../services/auth/auth.service.js';
import { LoginDto } from '../../dto/login.dto.js';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator.js';

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

  //Only login endpoint
  /*@Post('login') //creates a POST endpoint.
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
    //@Body() extracts the JSON request body.
    //LoginDto validates the incoming data through your global ValidationPipe.
  }*/

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
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

  @Public()
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
  
  @Public()
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
