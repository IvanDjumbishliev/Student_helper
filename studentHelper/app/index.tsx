import { Redirect } from 'expo-router';
import { useSession } from '../ctx';

export default function Index() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return null; 
  }

  if (session) {
    return <Redirect href="/home" />;
  } else {
    return <Redirect href="/sign-in" />;
  }
}