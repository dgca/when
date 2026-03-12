import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Container, Box, Heading, Text } from "@tosui/react";
import type { QueryClient } from "@tanstack/react-query";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <Container size="sm" py={6} px={4}>
      <Box mb={6}>
        <Heading as="h1" size="2xl" weight="bold">
          When
        </Heading>
        <Text size="sm" color="foreground-muted">
          Find a time that works for everyone
        </Text>
      </Box>
      <Outlet />
    </Container>
  );
}
