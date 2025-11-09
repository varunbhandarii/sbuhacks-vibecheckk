// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { useAuth0, type GetTokenSilentlyOptions } from '@auth0/auth0-react';
import { jwtDecode } from 'jwt-decode'; // <-- 1. IMPORT
import { type UserRole } from '../types'; // <-- 2. IMPORT

// 3. UPDATE THE INTERFACE (for local use)
interface AuthContextType {
  anonymousToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: UserRole; // The user's role
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 4. UPDATE TOKEN EXCHANGE HELPER
// It now returns both the token AND the role
async function exchangeAuth0Token(
  getAccessToken: (options?: GetTokenSilentlyOptions) => Promise<string>
): Promise<{ token: string; role: UserRole } | null> {
  try {
    const auth0Token = await getAccessToken({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      },
    });

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const response = await fetch(`${apiBaseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: auth0Token }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange token');
    }

    const data = await response.json();
    const token = data.anonymous_token;
    
    // 5. DECODE THE TOKEN TO GET THE ROLE
    // We assume the backend's token has a { "role": "student" } payload
    const decoded = jwtDecode<{ role?: UserRole }>(token);
    const role = decoded.role || 'student'; // Default to 'student'

    return { token, role };
  } catch (e) {
    console.error('Token exchange failed:', e);
    return null;
  }
}

// The provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    isLoading: isAuth0Loading,
    isAuthenticated: isAuth0Authenticated,
    getAccessTokenSilently,
    loginWithRedirect,
    logout: auth0Logout,
  } = useAuth0();

  const [anonymousToken, setAnonymousToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>('student'); // <-- 6. ADD ROLE STATE
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuth0Loading) {
      setIsLoading(true);
      return;
    }

    if (!isAuth0Authenticated) {
      setIsLoading(false);
      setAnonymousToken(null);
      setRole('student'); // Reset role on logout
      return;
    }

    if (isAuth0Authenticated && !anonymousToken) {
      setIsLoading(true);
      exchangeAuth0Token(getAccessTokenSilently).then((result) => {
        if (result) {
          // 7. SET BOTH TOKEN AND ROLE
          setAnonymousToken(result.token);
          setRole(result.role);
        }
        setIsLoading(false);
      });
    }

    if (isAuth0Authenticated && anonymousToken) {
      setIsLoading(false);
    }
  }, [isAuth0Loading, isAuth0Authenticated, anonymousToken, getAccessTokenSilently]);

  const login = () => {
    loginWithRedirect({
      appState: { returnTo: window.location.pathname },
    });
  };

  const logout = () => {
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });
    setAnonymousToken(null);
    setRole('student'); // <-- 8. RESET ROLE ON LOGOUT
  };

  const value: AuthContextType = {
    anonymousToken,
    isLoading,
    isAuthenticated: !isLoading && !!anonymousToken,
    role, // <-- 9. PROVIDE THE ROLE
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The custom hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};