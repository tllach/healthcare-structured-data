import { Badge } from "./Badge";

export interface ConfidenceBadgeProps {
  score: number;
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  if (score >= 0.85) {
    return <Badge variant="success" label="High confidence" />;
  }
  if (score >= 0.6 && score < 0.85) {
    return <Badge variant="warning" label="Review suggested" />;
  }
  if (score > 0 && score < 0.6) {
    return <Badge variant="error" label="Low confidence" />;
  }
  return <Badge variant="neutral" label="Not found" />;
}
