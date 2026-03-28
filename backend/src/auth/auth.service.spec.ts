import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Keypair, WebAuth } from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const SERVER_KEYPAIR = Keypair.random();
const CLIENT_KEYPAIR = Keypair.random();

const mockConfig: Partial<Record<string, string>> = {
  STELLAR_SERVER_SECRET: SERVER_KEYPAIR.secret(),
  HOME_DOMAIN: 'localhost',
  WEB_AUTH_DOMAIN: 'localhost',
  STELLAR_NETWORK: 'Test SDF Network ; September 2015',
};

describe('AuthService - generateChallenge', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (mockConfig[key] === undefined)
                throw new Error(`Missing ${key}`);
              return mockConfig[key];
            },
            get: (key: string, defaultValue?: string) =>
              mockConfig[key] ?? defaultValue,
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('returns a valid challenge for a well-formed Stellar address', () => {
    const address = CLIENT_KEYPAIR.publicKey();
    const result = service.generateChallenge(address);

    expect(result.address).toBe(address);
    expect(result.transaction).toBeTruthy();
    expect(result.homeDomain).toBe('localhost');
    expect(result.webAuthDomain).toBe('localhost');
    expect(result.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(result.nonce).toBeTruthy();
    expect(result.expiresIn).toBe(300);
    expect(result.issuedAt).toBeCloseTo(Math.floor(Date.now() / 1000), -1);
  });

  it('returns a transaction that passes SEP-10 readChallengeTx verification', () => {
    const address = CLIENT_KEYPAIR.publicKey();
    const { transaction, networkPassphrase } =
      service.generateChallenge(address);

    expect(() =>
      WebAuth.readChallengeTx(
        transaction,
        SERVER_KEYPAIR.publicKey(),
        networkPassphrase,
        'localhost',
        'localhost',
      ),
    ).not.toThrow();
  });

  it('throws BadRequestException for an invalid Stellar address', () => {
    expect(() => service.generateChallenge('notavalidkey')).toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException for an empty address', () => {
    expect(() => service.generateChallenge('')).toThrow(BadRequestException);
  });
});
