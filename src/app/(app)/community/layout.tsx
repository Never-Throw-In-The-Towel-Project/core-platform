import { CommunityTabs } from "@/components/community/CommunityTabs";

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <CommunityTabs />
      {children}
    </div>
  );
}
