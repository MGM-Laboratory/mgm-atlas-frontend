import Link from 'next/link';
import { ShapeSignature } from '@/components/brand/shape-signature';
import { PatternDado } from '@/components/brand/pattern-corner';
import { Container } from './container';

export function Footer() {
  return (
    <footer className="mt-24 bg-white">
      <Container size="2xl" className="py-12">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <ShapeSignature size={28} />
            <p className="mt-4 max-w-[24ch] text-[14px] text-ink-3">
              The project portfolio dashboard for MGM Laboratory.
            </p>
          </div>
          <FooterColumn title="Atlas">
            <FooterLink href="/dashboard">Discover</FooterLink>
            <FooterLink href="/projects">Browse projects</FooterLink>
            <FooterLink href="/projects/new">Start a project</FooterLink>
          </FooterColumn>
          <FooterColumn title="Lab">
            <FooterLink href="https://labmgm.org" external>
              MGM Laboratory
            </FooterLink>
            <FooterLink href="https://iam.labmgm.org" external>
              Identity
            </FooterLink>
            <FooterLink href="https://n8n.labmgm.org" external>
              Automation
            </FooterLink>
          </FooterColumn>
          <FooterColumn title="Support">
            <FooterLink href="/health">Status</FooterLink>
            <FooterLink href="mailto:atlas@labmgm.org">Contact</FooterLink>
          </FooterColumn>
        </div>
      </Container>

      <PatternDado height={8} />

      <Container size="2xl" className="flex flex-col gap-2 py-6 md:flex-row md:items-center md:justify-between">
        <span className="text-[13px] text-ink-3">
          © {new Date().getFullYear()} MGM Laboratory. All rights reserved.
        </span>
        <div className="flex gap-6 text-[13px] text-ink-3">
          <Link href={'/health' as never} className="hover:text-ink">
            Status
          </Link>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-[13px] font-semibold text-ink">{title}</h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  if (external) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-[14px] text-ink-3 hover:text-ink"
        >
          {children}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={href as never} className="text-[14px] text-ink-3 hover:text-ink">
        {children}
      </Link>
    </li>
  );
}
