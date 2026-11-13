import { Body, Controller, Post } from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')//defines the controller's route prefix.
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')//creates a POST endpoint.
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
    //@Body() extracts the JSON request body.
    //LoginDto validates the incoming data through your global ValidationPipe.
    //
  }
}
