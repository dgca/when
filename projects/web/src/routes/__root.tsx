import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Container, Box, Heading, Text, HStack } from "@tosui/react";
import { useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { PlanDrawer } from "../components/PlanDrawer";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Container size="sm" py={6} px={4}>
      <Box mb={6}>
        <HStack gap={3} align="center">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span style={{ display: "block", width: "20px", height: "2px", background: "var(--colors-foreground, #333)" }} />
            <span style={{ display: "block", width: "20px", height: "2px", background: "var(--colors-foreground, #333)" }} />
            <span style={{ display: "block", width: "20px", height: "2px", background: "var(--colors-foreground, #333)" }} />
          </button>
          <Box>
            <Heading as="h1" size="2xl" weight="bold">
              When
            </Heading>
            <Text size="sm" color="foreground-muted">
              Find a time that works for everyone
            </Text>
          </Box>
        </HStack>
      </Box>
      <Outlet />
      <PlanDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Container>
  );
}
