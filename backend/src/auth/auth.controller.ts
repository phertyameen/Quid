import { Controller, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('challenge')
  generateChallenge(@Query('address') address: string) {
    return this.authService.generateChallenge(address);
  }
}
