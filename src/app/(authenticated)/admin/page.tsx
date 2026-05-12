'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { SessionUser } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TagManager } from '@/components/admin/tag-manager';
import { UserManager } from '@/components/admin/user-manager';
import { CollaborationRoleManager } from '@/components/admin/role-manager';
import { FeaturedManager } from '@/components/admin/featured-manager';

export default function AdminPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const tab = searchParams.get('tab') || 'tags';

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const userData = await api<SessionUser>(apiPaths.session()).catch(() => null);
        if (!userData?.isAdmin) {
          router.push('/dashboard');
          return;
        }
        setMe(userData);
      } catch (err) {
        console.error('Failed to fetch user:', err);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <Container size="2xl" className="space-y-8 py-10">
        <div className="h-40 animate-pulse rounded bg-line" />
      </Container>
    );
  }

  if (!me?.isAdmin) return null;

  return (
    <Container size="2xl" className="space-y-8 py-10">
      <header>
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-brand-blue">
          Admin
        </span>
        <h1 className="mt-1 font-display text-display-lg tracking-[-0.02em] text-ink">
          Atlas controls
        </h1>
        <p className="mt-2 max-w-prose text-body text-ink-2">
          Configure the platform: tags, featured projects, collaboration roles, and member access.
        </p>
      </header>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="featured">Featured</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="tags">
          <TagManager />
        </TabsContent>
        <TabsContent value="featured">
          <FeaturedManager />
        </TabsContent>
        <TabsContent value="roles">
          <CollaborationRoleManager />
        </TabsContent>
        <TabsContent value="users">
          <UserManager />
        </TabsContent>
      </Tabs>
    </Container>
  );
}
