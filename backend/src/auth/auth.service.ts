import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  Networks,
  Operation,
  StrKey,
  Transaction,
  WebAuth,
} from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

const CHALLENGE_TIMEOUT = 300;

export interface ChallengeResponse {
  address: string;
  transaction: string;
  homeDomain: string;
  webAuthDomain: string;
  networkPassphrase: string;
  nonce: string;
  issuedAt: number;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly serverAccountId: string,
    private readonly networkPassphrase: string,
    private readonly horizonUrl: string,
    private readonly jwtService: JwtService,
  ) {}

  private getSep10Config() {
    const homeDomain = this.config.get<string>('STELLAR_HOME_DOMAIN') || '';
    const webAuthDomain =
      this.config.get<string>('STELLAR_WEB_AUTH_DOMAIN') || '';

    if (!homeDomain) {
      throw new Error('STELLAR_HOME_DOMAIN environment variable is required');
    }

    if (!webAuthDomain) {
      throw new Error(
        'STELLAR_WEB_AUTH_DOMAIN environment variable is required',
      );
    }

    return {
      serverAccountId: this.serverAccountId,
      homeDomain,
      networkPassphrase: this.networkPassphrase,
      webAuthDomain,
    };
  }

  generateChallenge(address: string): ChallengeResponse {
    if (!StrKey.isValidEd25519PublicKey(address)) {
      throw new BadRequestException('Invalid Stellar public key');
    }

    const serverSecret = this.config.getOrThrow<string>(
      'STELLAR_SERVER_SECRET',
    );
    const serverKeypair = Keypair.fromSecret(serverSecret);

    const homeDomain = this.config.getOrThrow<string>('HOME_DOMAIN');
    const webAuthDomain = this.config.getOrThrow<string>('WEB_AUTH_DOMAIN');
    const networkPassphrase = this.config.get<string>(
      'STELLAR_NETWORK',
      Networks.TESTNET,
    );

    const issuedAt = Math.floor(Date.now() / 1000);

    const transaction = WebAuth.buildChallengeTx(
      serverKeypair,
      address,
      homeDomain,
      CHALLENGE_TIMEOUT,
      networkPassphrase,
      webAuthDomain,
    );

    const tx = new Transaction(transaction, networkPassphrase);
    const manageDataOp = tx.operations[0] as Operation.ManageData;
    const nonce = manageDataOp.value?.toString('base64') ?? '';

    return {
      address,
      transaction,
      homeDomain,
      webAuthDomain,
      networkPassphrase,
      nonce,
      issuedAt,
      expiresIn: CHALLENGE_TIMEOUT,
    };
  }

  verifySignedPayload(_signedXdr: string): string {
    const { serverAccountId, homeDomain, networkPassphrase, webAuthDomain } =
      this.getSep10Config();

    try {
      const { clientAccountID } = WebAuth.readChallengeTx(
        _signedXdr,
        serverAccountId,
        networkPassphrase,
        homeDomain,
        webAuthDomain,
      );

      WebAuth.verifyChallengeTxSigners(
        _signedXdr,
        serverAccountId,
        networkPassphrase,
        [clientAccountID],
        homeDomain,
        webAuthDomain,
      );

      return this.issueTokenForAddress(clientAccountID);
    } catch (error) {
      throw new UnauthorizedException(this.getSep10ErrorMessage(error));
    }
  }

  private issueTokenForAddress(address: string): string {
    const payload = { sub: address };
    return this.jwtService.sign(payload);
  }

  private getSep10ErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Invalid SEP-10 challenge response';
  }

  validateUser(publicKey: string) {
    return this.prisma.user.findUnique({ where: { email: publicKey } });
  }
}
