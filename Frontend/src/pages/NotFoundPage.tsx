import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="text-8xl font-black text-zinc-200 mb-4">404</div>
        <h1 className="text-2xl font-bold text-zinc-800 mb-2">Page not found</h1>
        <p className="text-zinc-500 mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={() => navigate('/')}>Go home</Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button>
        </div>
      </div>
    </div>
  );
};
