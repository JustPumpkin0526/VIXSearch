import React from 'react';
import { useAuth } from '../hooks/useAuth';

type AdminUser = {
  username: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminUsersPanel() {
  const { user } = useAuth();

  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'user'>('user');
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [
    deletingUsername,
    setDeletingUsername,
  ] = React.useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const loadUsers = React.useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/users');
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load users');
      }

      setUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();

    setCreating(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          role,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create user');
      }

      setUsername('');
      setPassword('');
      setRole('user');
      setMessage(`계정이 생성되었습니다: ${payload.user.username}`);
      await loadUsers();
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = React.useCallback(
    async (targetUser: AdminUser) => {
      if (!user) {
        return;
      }

      if (targetUser.username === user.username) {
        setError(
          '현재 로그인한 계정은 삭제할 수 없습니다.',
        );
        setMessage('');
        return;
      }

      const confirmed = window.confirm(
        [
          `'${targetUser.username}' 계정을 삭제하시겠습니까?`,
          '',
          '해당 계정의 로그인 정보와 사용자별 저장 데이터가 삭제됩니다.',
          '이 작업은 되돌릴 수 없습니다.',
        ].join('\n'),
      );

      if (!confirmed) {
        return;
      }

      setDeletingUsername(targetUser.username);
      setError('');
      setMessage('');

      try {
        const response = await fetch(
          '/api/admin/users',
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: targetUser.username,
            }),
          },
        );

        const payload = await response
          .json()
          .catch(() => null);

        if (!response.ok) {
          throw new Error(
            payload?.error ||
            'Failed to delete user',
          );
        }

        /*
         * 응답을 기다리지 않고 화면에서도 먼저 제거합니다.
         */
        setUsers(currentUsers =>
          currentUsers.filter(
            item =>
              item.username !==
              targetUser.username,
          ),
        );

        setMessage(
          `계정이 삭제되었습니다: ${targetUser.username}`,
        );

        /*
         * DB 상태와 화면 상태를 다시 일치시킵니다.
         */
        await loadUsers();
      } catch (err: any) {
        setError(
          String(
            err?.message ||
            '계정 삭제 중 오류가 발생했습니다.',
          ),
        );
      } finally {
        setDeletingUsername(null);
      }
    },
    [
      loadUsers,
      user,
    ],
  );

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-950 text-white">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8">
          <h2 className="text-xl font-semibold">접근 권한 없음</h2>
          <p className="mt-2 text-sm text-gray-400">
            관리자 권한이 필요한 메뉴입니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">관리자 메뉴</h1>
          <p className="mt-1 text-sm text-gray-400">
            사용자 계정을 생성하고 확인하거나 삭제합니다.
          </p>
        </div>

        <form
          onSubmit={handleCreateUser}
          className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow"
        >
          <h2 className="text-lg font-semibold">사용자 계정 생성</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-gray-300">
                아이디
              </label>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                placeholder="user01"
                autoComplete="off"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">
                비밀번호
              </label>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                placeholder="8자 이상"
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">
                권한
              </label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as 'admin' | 'user')}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                <option value="user">일반 사용자</option>
                <option value="admin">관리자</option>
              </select>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="mt-4 rounded-lg border border-green-800 bg-green-950/60 px-3 py-2 text-sm text-green-200">
              {message}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? '생성 중...' : '계정 생성'}
            </button>
          </div>
        </form>

        <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">계정 목록</h2>

            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-gray-200 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50"
            >
              새로고침
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-800 text-sm">
              <thead className="bg-neutral-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    아이디
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    권한
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    생성자
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-300">
                    생성일
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-300">
                    작업
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-800">
                {users.map(item => (
                  <tr key={item.username}>
                    <td className="px-4 py-3 text-white">
                      {item.username}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          item.role === 'admin'
                            ? 'rounded-full bg-purple-900/60 px-2 py-1 text-xs text-purple-200'
                            : 'rounded-full bg-blue-900/60 px-2 py-1 text-xs text-blue-200'
                        }
                      >
                        {item.role}
                      </span>
                    </td>
                      
                    <td className="px-4 py-3">
                      {item.isActive ? (
                        <span className="text-green-300">
                          active
                        </span>
                      ) : (
                        <span className="text-red-300">
                          disabled
                        </span>
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-gray-300">
                      {item.createdBy || '-'}
                    </td>
                    
                    <td className="px-4 py-3 text-gray-400">
                      {item.createdAt
                        ? new Date(
                            item.createdAt,
                          ).toLocaleString()
                        : '-'}
                    </td>
                        
                    <td className="px-4 py-3 text-right">
                      {item.username === user?.username ? (
                        <span className="text-xs text-gray-500">
                          현재 계정
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteUser(item);
                          }}
                          disabled={
                            deletingUsername !== null ||
                            loading
                          }
                          className="rounded-lg border border-red-800 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:border-red-500 hover:bg-red-950/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingUsername ===
                          item.username
                            ? '삭제 중...'
                            : '삭제'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      {loading ? '불러오는 중...' : '생성된 계정이 없습니다.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}