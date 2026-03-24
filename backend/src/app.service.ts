import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
