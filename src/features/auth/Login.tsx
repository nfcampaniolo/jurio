import React from 'react';
import { AuthLayout } from './components/AuthLayout.tsx';
import { AuthForm } from './components/AuthForm';
import { GoogleButton } from './components/GoogleButton';

export const Login: React.FC = () => (
  <AuthLayout>
    <div className="flex flex-col gap-6">
      <AuthForm initialMode="register" />
      
      <div className="relative flex items-center py-2">
        <div className="grow border-t border-gray-200"></div>
        <span className="shrink-0 mx-4 text-xs text-gray-400 uppercase tracking-wider">
          oppure
        </span>
        <div className="grow border-t border-gray-200"></div>
      </div>

      <GoogleButton />
    </div>
  </AuthLayout>
);