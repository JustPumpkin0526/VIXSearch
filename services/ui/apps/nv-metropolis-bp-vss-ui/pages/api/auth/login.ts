import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';

import {
  buildRefreshTokenCookie,
  createRefreshToken,
  findUserByUsername,
  issueJwt,
  sanitizeUsername,
  storeRefreshToken,
  verifyPasswordAsync,
} from './_lib';
import { rateLimit } from '../_rateLimit';

type LoginErrorCode =
  | 'AUTH_REQUIRED_FIELDS'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_METHOD_NOT_ALLOWED'
  | 'AUTH_SERVER_ERROR';

function sendLoginError(
  res: NextApiResponse,
  status: number,
  code: LoginErrorCode,
  message: string,
) {
  return res.status(status).json({
    code,
    error: message,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // Simple rate limiting to mitigate brute-force and high-frequency login attempts.
    await rateLimit(req, res);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');

      return sendLoginError(
        res,
        405,
        'AUTH_METHOD_NOT_ALLOWED',
        '지원하지 않는 요청 방식입니다.',
      );
    }

    const startedAt = Date.now();

    const mark = (name: string) => {
      console.info(
        `[auth/login] ${name}: ${Date.now() - startedAt}ms`,
      );
    };

    const username = sanitizeUsername(
      String(req.body?.username || ''),
    );

    const password = String(
      req.body?.password || '',
    );

    if (!username || !password) {
      return sendLoginError(
        res,
        400,
        'AUTH_REQUIRED_FIELDS',
        '아이디와 비밀번호를 모두 입력해 주세요.',
      );
    }

    const user =
      await findUserByUsername(username);

    mark('findUserByUsername');

    /*
     * 존재하지 않는 계정과 비활성 계정을 동일하게 처리합니다.
     * 계정 존재 여부가 외부에 노출되지 않도록 하기 위한 처리입니다.
     */
    if (!user || !user.isActive) {
      return sendLoginError(
        res,
        401,
        'AUTH_INVALID_CREDENTIALS',
        '존재하지 않는 ID/PW 입니다.',
      );
    }

    const passwordMatched =
      await verifyPasswordAsync(
        password,
        user.salt,
        user.passwordHash,
      );

    mark('verifyPasswordAsync');

    if (!passwordMatched) {
      return sendLoginError(
        res,
        401,
        'AUTH_INVALID_CREDENTIALS',
        '존재하지 않는 ID/PW 입니다.',
      );
    }

    const { token, exp } = issueJwt(
      user.username,
      user.role,
    );

    mark('issueJwt');

    const refreshToken =
      createRefreshToken();

    await storeRefreshToken(
      user.username,
      refreshToken,
    );

    mark('storeRefreshToken');

    res.setHeader(
      'Set-Cookie',
      buildRefreshTokenCookie(
        refreshToken,
      ),
    );

    return res.status(200).json({
      user: {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
      token,
      expiresAt: exp,
    });
  } catch (error) {
    /*
     * 상세 서버 오류는 로그에만 남기고,
     * 화면에는 DB 주소나 내부 예외 내용을 노출하지 않습니다.
     */
    console.error(
      '[auth/login] failed:',
      error,
    );

    return sendLoginError(
      res,
      500,
      'AUTH_SERVER_ERROR',
      '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}