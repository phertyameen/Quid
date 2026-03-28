import { BadRequestException, Injectable } from '@nestjs/common';
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
  ) {}

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

  validateUser(publicKey: string) {
    return this.prisma.user.findUnique({ where: { email: publicKey } });
  }
}
