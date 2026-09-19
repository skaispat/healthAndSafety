import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/database';
import { DataService, subscribeToDataChanges } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentUser: User | null;
  role: UserRole;
  isOfficer: boolean;
  isUser: boolean;
  usersList: User[];
  loading: boolean;
  switchUser: (userId: string | number) => void;
  login: (username: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_USER_ID_KEY = 'ehs_active_user_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const users = await DataService.getUsers();
      setUsersList(users);

      const savedUserId = localStorage.getItem(ACTIVE_USER_ID_KEY) || localStorage.getItem('ehs_logged_in_emp_id');
      if (savedUserId) {
        const active = users.find(u => 
          Number(u.emp_id) === Number(savedUserId) || 
          String(u.emp_id) === String(savedUserId) || 
          String(u.id) === String(savedUserId) ||
          String(u.username)?.toLowerCase() === String(savedUserId).toLowerCase()
        );
        if (active) {
          const empId = Number(active.emp_id ?? active.id);
          const isOfficerRole = String(active.position || '').trim().toUpperCase() === 'HEALTH AND SAFETY';
          const derivedRole: UserRole = isOfficerRole ? 'HEALTH_SAFETY_OFFICER' : 'EMPLOYEE';
          const userObj: User = {
            ...active,
            emp_id: empId,
            id: String(empId),
            employee_id: String(empId),
            role: derivedRole,
          };
          setCurrentUser(userObj);
          localStorage.setItem('ehs_user_role', derivedRole);
          localStorage.setItem('ehs_user_data', JSON.stringify(userObj));
        } else {
          const savedData = localStorage.getItem('ehs_user_data');
          if (savedData) {
            try {
              const parsed = JSON.parse(savedData);
              const isOfficerRole = String(parsed.position || '').trim().toUpperCase() === 'HEALTH AND SAFETY';
              parsed.role = isOfficerRole ? 'HEALTH_SAFETY_OFFICER' : 'EMPLOYEE';
              setCurrentUser(parsed);
              localStorage.setItem('ehs_user_role', parsed.role);
            } catch (_) {}
          }
        }
      }
    } catch (e) {
      console.error('Error loading auth users', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    const unsubscribe = subscribeToDataChanges(() => {
      DataService.getUsers().then(users => {
        setUsersList(users);
        if (currentUser) {
          const updated = users.find(u => Number(u.emp_id) === Number(currentUser.emp_id));
          if (updated) {
            const empId = Number(updated.emp_id ?? updated.id);
            const isOfficerRole = String(updated.position || '').trim().toUpperCase() === 'HEALTH AND SAFETY';
            const derivedRole: UserRole = isOfficerRole ? 'HEALTH_SAFETY_OFFICER' : 'EMPLOYEE';
            const userObj: User = {
              ...updated,
              emp_id: empId,
              id: String(empId),
              employee_id: String(empId),
              role: derivedRole,
            };
            setCurrentUser(userObj);
            localStorage.setItem('ehs_user_role', derivedRole);
            localStorage.setItem('ehs_user_data', JSON.stringify(userObj));
          }
        }
      });
    });

    return unsubscribe;
  }, []);

  const switchUser = (userId: string | number) => {
    const user = usersList.find(u => Number(u.emp_id) === Number(userId) || u.id === String(userId));
    if (user) {
      const empId = Number(user.emp_id ?? user.id);
      const isOfficerRole = String(user.position || '').trim().toUpperCase() === 'HEALTH AND SAFETY';
      const derivedRole: UserRole = isOfficerRole ? 'HEALTH_SAFETY_OFFICER' : 'EMPLOYEE';
      const userObj = {
        ...user,
        emp_id: empId,
        id: String(empId),
        employee_id: String(empId),
        role: derivedRole,
      };
      setCurrentUser(userObj);
      localStorage.setItem(ACTIVE_USER_ID_KEY, String(empId));
      localStorage.setItem('ehs_logged_in_emp_id', String(empId));
      localStorage.setItem('ehs_user_role', String(userObj.role || 'user'));
      localStorage.setItem('ehs_user_data', JSON.stringify(userObj));
    }
  };

  // Login with username or emp_id and password against users table
  const login = async (username: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    const term = username.trim();
    if (!term) {
      return { success: false, message: 'Please enter your username or Employee ID.' };
    }

    // 1. Direct Supabase query if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('users').select('*');
        if (!isNaN(Number(term))) {
          query = query.or(`username.eq.${term},emp_id.eq.${Number(term)}`);
        } else {
          query = query.ilike('username', term);
        }

        const { data, error } = await query;
        if (error) {
          console.error('Supabase user query error', error);
        }

        if (data && data.length > 0) {
          const dbUser = data[0];

          // Validate password if user has password set
          if (dbUser.password && password && dbUser.password !== password) {
            return { success: false, message: 'Invalid password. Please check your credentials.' };
          }

          // Extract emp_id from users row
          const rawEmpId = dbUser.emp_id ?? dbUser.id ?? dbUser.employee_id;
          const empId = Number(rawEmpId);
          const isOfficerRole = String(dbUser.position || '').trim().toUpperCase() === 'HEALTH AND SAFETY';
          const derivedRole: UserRole = isOfficerRole ? 'HEALTH_SAFETY_OFFICER' : 'EMPLOYEE';

          const userObj: User = {
            emp_id: empId,
            id: String(empId),
            employee_id: String(empId),
            full_name: dbUser.full_name || dbUser.name || '',
            username: dbUser.username || '',
            email: dbUser.email || dbUser.username || '',
            password: dbUser.password,
            department: dbUser.department,
            department_name: typeof dbUser.department === 'string' ? dbUser.department : (dbUser.department?.name || null),
            role: derivedRole,
            status: dbUser.status || 'active',
            is_active: dbUser.status !== 'inactive',
            user_access: dbUser.user_access,
            dept_id: dbUser.dept_id ? Number(dbUser.dept_id) : null,
            mobile_number: dbUser.mobile_number,
            phone: dbUser.mobile_number,
            retail_access: dbUser.retail_access,
            position: dbUser.position,
            created_at: dbUser.created_at || new Date().toISOString(),
            updated_at: dbUser.created_at || new Date().toISOString(),
            profile_photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser.full_name || 'User')}&background=b91c1c&color=fff`,
          };

          setCurrentUser(userObj);
          localStorage.setItem(ACTIVE_USER_ID_KEY, String(userObj.emp_id));
          localStorage.setItem('ehs_logged_in_emp_id', String(userObj.emp_id));
          localStorage.setItem('ehs_user_role', String(userObj.role));
          localStorage.setItem('ehs_user_data', JSON.stringify(userObj));
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Supabase login check failed', err);
      }
    }

    // 2. Local users list fallback
    const allUsers = usersList.length > 0 ? usersList : await DataService.getUsers();
    const matched = allUsers.find(u => 
      u.username?.toLowerCase() === term.toLowerCase() || 
      String(u.emp_id) === term ||
      Number(u.emp_id) === Number(term)
    );

    if (matched) {
      if (matched.password && password && matched.password !== password) {
        return { success: false, message: 'Invalid password. Please check your credentials.' };
      }
      const rawEmpId = matched.emp_id ?? matched.id;
      const empId = Number(rawEmpId);
      const isOfficerRole = String(matched.position || '').trim().toUpperCase() === 'HEALTH AND SAFETY';
      const derivedRole: UserRole = isOfficerRole ? 'HEALTH_SAFETY_OFFICER' : 'EMPLOYEE';
      const userWithEmpId: User = {
        ...matched,
        emp_id: empId,
        id: String(empId),
        employee_id: String(empId),
        role: derivedRole,
      };
      setCurrentUser(userWithEmpId);
      localStorage.setItem(ACTIVE_USER_ID_KEY, String(empId));
      localStorage.setItem('ehs_logged_in_emp_id', String(empId));
      localStorage.setItem('ehs_user_role', String(userWithEmpId.role));
      localStorage.setItem('ehs_user_data', JSON.stringify(userWithEmpId));
      return { success: true };
    }

    return { success: false, message: 'No user account found matching that username or Employee ID.' };
  };

  const logout = () => {
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
    localStorage.removeItem('ehs_logged_in_emp_id');
    localStorage.removeItem('ehs_user_role');
    localStorage.removeItem('ehs_user_data');
    setCurrentUser(null);
  };

  // Determine admin/safety officer role strictly from position column:
  // position === 'HEALTH AND SAFETY' -> Admin (Health & Safety Officer)
  // anything else or null -> User (Employee)
  const isOfficer = Boolean(
    currentUser?.position && currentUser.position.trim().toUpperCase() === 'HEALTH AND SAFETY'
  );
  const isUser = !isOfficer;
  const role: UserRole = isOfficer ? 'HEALTH_SAFETY_OFFICER' : 'EMPLOYEE';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        isOfficer,
        isUser,
        usersList,
        loading,
        switchUser,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
