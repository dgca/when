import { Box, Text, HStack, Badge } from "@tosui/react";
import type { PlanResults } from "@when/shared";

interface Props {
  results: PlanResults;
}

export function ResultsTable({ results }: Props) {
  const { plan, responses, optionSummary } = results;

  if (responses.length === 0) {
    return (
      <Box w="100%" p={4} border="thin" borderColor="border" rounded="md">
        <Text color="foreground-muted" size="sm">
          No responses yet. Share the link to get started!
        </Text>
      </Box>
    );
  }

  const sortedOptionIds = optionSummary.map((s) => s.optionId);
  const optionMap = Object.fromEntries(plan.options.map((o) => [o.id, o]));

  return (
    <Box w="100%" overflow="auto">
      <Box
        as="table"
        w="100%"
        style={{ borderCollapse: "collapse", fontSize: "14px" }}
      >
        <Box as="thead">
          <Box as="tr">
            <Box as="th" p={2} style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
              <Text weight="semibold" size="sm">
                Option
              </Text>
            </Box>
            {responses.map((r) => (
              <Box
                key={r.id}
                as="th"
                p={2}
                style={{
                  textAlign: "center",
                  borderBottom: "1px solid #e2e8f0",
                  minWidth: "70px",
                }}
              >
                <Text weight="semibold" size="xs">
                  {r.participantName}
                </Text>
              </Box>
            ))}
            <Box as="th" p={2} style={{ textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
              <Text weight="semibold" size="xs">
                Total
              </Text>
            </Box>
          </Box>
        </Box>
        <Box as="tbody">
          {sortedOptionIds.map((optionId) => {
            const opt = optionMap[optionId];
            const summary = optionSummary.find((s) => s.optionId === optionId)!;
            if (!opt) return null;

            return (
              <Box as="tr" key={optionId}>
                <Box as="td" p={2} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <Text size="sm">{opt.label}</Text>
                </Box>
                {responses.map((r) => {
                  const sel = r.selections.find((s) => s.optionId === optionId);
                  return (
                    <Box
                      key={r.id}
                      as="td"
                      p={2}
                      style={{ textAlign: "center", borderBottom: "1px solid #f1f5f9" }}
                    >
                      {sel?.value === "yes" ? (
                        <Badge colorScheme="success" size="sm">
                          Yes
                        </Badge>
                      ) : sel?.value === "maybe" ? (
                        <Badge colorScheme="warning" size="sm">
                          Maybe
                        </Badge>
                      ) : (
                        <Text color="foreground-muted" size="xs">
                          —
                        </Text>
                      )}
                    </Box>
                  );
                })}
                <Box
                  as="td"
                  p={2}
                  style={{ textAlign: "center", borderBottom: "1px solid #f1f5f9" }}
                >
                  <HStack gap={1} justify="center">
                    {summary.yesCount > 0 && (
                      <Badge colorScheme="success" size="sm">
                        {summary.yesCount}
                      </Badge>
                    )}
                    {summary.maybeCount > 0 && (
                      <Badge colorScheme="warning" size="sm">
                        {summary.maybeCount}?
                      </Badge>
                    )}
                    {summary.yesCount === 0 && summary.maybeCount === 0 && (
                      <Text size="xs" color="foreground-muted">
                        0
                      </Text>
                    )}
                  </HStack>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
