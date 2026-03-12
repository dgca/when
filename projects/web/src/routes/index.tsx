import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Box, Button, Input, Textarea, FormField, Heading, Text, VStack, HStack } from "@tosui/react";
import { api } from "../api";

export const Route = createFileRoute("/")({
  component: CreatePlanPage,
});

function CreatePlanPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [options, setOptions] = useState<
    Array<{ date: string; startTime: string; endTime: string }>
  >([{ date: "", startTime: "", endTime: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addOption = () => {
    setOptions([...options, { date: "", startTime: "", endTime: "" }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 1) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: string, value: string) => {
    setOptions(options.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const planOptions = options
        .filter((opt) => opt.date && opt.startTime)
        .map((opt) => {
          const startsAt = new Date(`${opt.date}T${opt.startTime}`).toISOString();
          const endsAt = opt.endTime
            ? new Date(`${opt.date}T${opt.endTime}`).toISOString()
            : undefined;
          const label = opt.endTime
            ? `${opt.date} ${opt.startTime}–${opt.endTime}`
            : `${opt.date} ${opt.startTime}`;
          return { label, startsAt, endsAt };
        });

      if (planOptions.length === 0) {
        setError("Add at least one time option");
        setSubmitting(false);
        return;
      }

      const result = await api.createPlan({
        title,
        description: description || undefined,
        timezone,
        options: planOptions,
      });

      localStorage.setItem(`when-admin-${result.id}`, result.adminToken);

      navigate({
        to: "/a/$planId",
        params: { planId: result.id },
        search: { token: result.adminToken },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Heading as="h2" size="xl" mb={4}>
        Create a plan
      </Heading>
      <form onSubmit={handleSubmit}>
        <VStack gap={4}>
          <FormField label="Title">
            <Input
              placeholder="Dinner this weekend?"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Description (optional)">
            <Textarea
              placeholder="Add details about the plan..."
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              rows={2}
            />
          </FormField>

          <Box>
            <Text size="sm" color="foreground-muted">
              Timezone: {timezone}
            </Text>
          </Box>

          <Box w="100%">
            <Text weight="semibold" mb={2}>
              Time options
            </Text>
            <VStack gap={3}>
              {options.map((opt, i) => (
                <HStack key={i} gap={2} w="100%" align="end">
                  <Box flex="1">
                    <Text size="xs" color="foreground-muted" mb={1}>
                      Date
                    </Text>
                    <Input
                      type="date"
                      value={opt.date}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateOption(i, "date", e.target.value)
                      }
                      required
                    />
                  </Box>
                  <Box flex="1">
                    <Text size="xs" color="foreground-muted" mb={1}>
                      Start
                    </Text>
                    <Input
                      type="time"
                      value={opt.startTime}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateOption(i, "startTime", e.target.value)
                      }
                      required
                    />
                  </Box>
                  <Box flex="1">
                    <Text size="xs" color="foreground-muted" mb={1}>
                      End
                    </Text>
                    <Input
                      type="time"
                      value={opt.endTime}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateOption(i, "endTime", e.target.value)
                      }
                    />
                  </Box>
                  {options.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(i)}
                      type="button"
                    >
                      ✕
                    </Button>
                  )}
                </HStack>
              ))}
            </VStack>
            <Button variant="outline" size="sm" mt={2} onClick={addOption} type="button">
              + Add option
            </Button>
          </Box>

          {error && (
            <Text color="error" size="sm">
              {error}
            </Text>
          )}

          <Button type="submit" loading={submitting} fullWidth>
            Create plan
          </Button>
        </VStack>
      </form>
    </Box>
  );
}
