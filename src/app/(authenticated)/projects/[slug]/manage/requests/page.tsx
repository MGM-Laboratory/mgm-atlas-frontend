import { redirect } from 'next/navigation';

// Backend-generated notification links point at /projects/<slug>/manage/requests,
// but the Manage screen is tab-based at /projects/<slug>/manage?tab=requests.
// Forward the legacy path so notifications never 404.
export default async function ManageRequestsRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/projects/${slug}/manage?tab=requests`);
}
