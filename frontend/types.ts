import React from 'react';

export interface Library {
  name: string;
  source: string;
  tokens: string;
  snippets: string;
  update: string;
  status: 'active' | 'inactive';
  icon?: React.ReactNode;
}

export interface ApiKey {
  name: string;
  key: string;
  created: string;
  lastUsed: string;
}

export type View = 'home' | 'dashboard';