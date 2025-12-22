import { redirect } from 'next/navigation';

export default async function AddressRedirect({ params }) {
  const { address } = await params;
  redirect(`/scan/${address}/account`);
}
