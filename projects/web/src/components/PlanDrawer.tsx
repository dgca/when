import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Box, Heading, Text, VStack } from "@tosui/react";
import { getPlanStore, type PlanEntry } from "../planStore";

interface PlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function PlanDrawer({ isOpen, onClose }: PlanDrawerProps) {
  const [plans, setPlans] = useState<[string, PlanEntry][]>([]);

  useEffect(() => {
    if (isOpen) {
      const store = getPlanStore();
      const sorted = Object.entries(store).sort(
        ([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      setPlans(sorted);
    }
  }, [isOpen]);

  const created = plans.filter(([, e]) => e.adminToken);
  const joined = plans.filter(([, e]) => !e.adminToken);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 999,
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "min(320px, 85vw)",
          background: "var(--colors-background, #fff)",
          boxShadow: isOpen ? "2px 0 12px rgba(0,0,0,0.15)" : "none",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s ease",
          zIndex: 1000,
          overflowY: "auto",
          padding: "1.5rem 1rem",
        }}
      >
        <Box mb={4}>
          <Heading as="h2" size="lg">
            Your plans
          </Heading>
        </Box>

        {plans.length === 0 && (
          <Text color="foreground-muted" size="sm">
            No plans yet. Create one or respond to a shared link to see it here.
          </Text>
        )}

        {created.length > 0 && (
          <Box mb={4}>
            <Text size="xs" color="foreground-muted" weight="semibold" mb={2}>
              Created
            </Text>
            <VStack gap={1}>
              {created.map(([id, entry]) => (
                <Link
                  key={id}
                  to="/a/$planId"
                  params={{ planId: id }}
                  search={{ token: entry.adminToken! }}
                  onClick={onClose}
                  style={{ textDecoration: "none", display: "block", width: "100%" }}
                >
                  <Box
                    p={2}
                    rounded="md"
                    _hover={{ bg: "surface" }}
                    style={{ cursor: "pointer" }}
                  >
                    <Text size="sm" weight="semibold">
                      {entry.title}
                    </Text>
                    <Text size="xs" color="foreground-muted">
                      {timeAgo(entry.timestamp)}
                    </Text>
                  </Box>
                </Link>
              ))}
            </VStack>
          </Box>
        )}

        {joined.length > 0 && (
          <Box>
            <Text size="xs" color="foreground-muted" weight="semibold" mb={2}>
              Joined
            </Text>
            <VStack gap={1}>
              {joined.map(([id, entry]) => (
                <Link
                  key={id}
                  to="/p/$planId"
                  params={{ planId: id }}
                  onClick={onClose}
                  style={{ textDecoration: "none", display: "block", width: "100%" }}
                >
                  <Box
                    p={2}
                    rounded="md"
                    _hover={{ bg: "surface" }}
                    style={{ cursor: "pointer" }}
                  >
                    <Text size="sm" weight="semibold">
                      {entry.title}
                    </Text>
                    <Text size="xs" color="foreground-muted">
                      {timeAgo(entry.timestamp)}
                    </Text>
                  </Box>
                </Link>
              ))}
            </VStack>
          </Box>
        )}
      </div>
    </>
  );
}
