import React from 'react';
import { Library, ApiKey } from './types';
import { Box, Database, FileCode, Layers, Layout, Server, Zap, Globe, Cpu, Command } from 'lucide-react';

export const LIBRARIES: Library[] = [
  { name: 'Next.js', source: '/vercel/next.js', tokens: '825K', snippets: '3.3K', update: '1 day', status: 'active', icon: <Zap size={16} /> },
  { name: 'Better Auth', source: '/better-auth/better-auth', tokens: '326K', snippets: '1.5K', update: '2 days', status: 'active', icon: <Box size={16} /> },
  { name: 'MongoDB', source: '/mongodb/docs', tokens: '15.8M', snippets: '131K', update: '1 month', status: 'active', icon: <Database size={16} /> },
  { name: 'React', source: 'react.dev', tokens: '553K', snippets: '1.9K', update: '3 days', status: 'active', icon: <Layout size={16} /> },
  { name: 'Vercel AI SDK', source: '/vercel/ai', tokens: '684K', snippets: '2.6K', update: '1 day', status: 'active', icon: <Command size={16} /> },
  { name: 'Tailwind CSS', source: 'tailwindcss.com/docs', tokens: '252K', snippets: '1.7K', update: '3 days', status: 'active', icon: <FileCode size={16} /> },
  { name: 'shadcn/ui', source: 'ui.shadcn.com/docs', tokens: '233K', snippets: '1K', update: '3 days', status: 'active', icon: <Layers size={16} /> },
  { name: 'LangGraph', source: '/langchain-ai/langgraph', tokens: '697K', snippets: '2.3K', update: '1 day', status: 'active', icon: <Cpu size={16} /> },
  { name: 'FastAPI', source: '/fastapi/fastapi', tokens: '236K', snippets: '695', update: '1 day', status: 'active', icon: <Server size={16} /> },
  { name: 'Supabase', source: '/supabase/supabase', tokens: '1.6M', snippets: '4.8K', update: '1 day', status: 'active', icon: <Globe size={16} /> },
];

export const API_KEYS: ApiKey[] = [
  { name: 'W1n', key: 'ctx7sk-****f272', created: 'Nov 19, 2025', lastUsed: 'Never' },
  { name: '1', key: 'ctx7sk-****9d44', created: 'Nov 14, 2025', lastUsed: 'Never' },
];

export const CURL_SNIPPET = `curl -X GET "https://context7.com/api/v1/search?query=react+hook+form" \\
  -H "Authorization: Bearer CONTEXT7_API_KEY"`;
