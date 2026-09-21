import { Slot } from 'expo-router';
import { BackofficeShell } from '@/components/layout/BackofficeShell';
export default function AppLayout() { return <BackofficeShell><Slot /></BackofficeShell>; }
