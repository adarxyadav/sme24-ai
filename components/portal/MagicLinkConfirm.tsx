import { confirmMagicLink } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type MagicLinkConfirmProps = {
  tokenHash: string;
  next: string;
};

// One button between the email and the session: the token is only exchanged on
// POST, so a link scanner's GET prefetch cannot consume it (auth.md).
export function MagicLinkConfirm({ tokenHash, next }: MagicLinkConfirmProps) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Almost there</CardTitle>
        <CardDescription>
          Press the button to finish signing in on this device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={confirmMagicLink}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" className="w-full">
            Continue to SME24
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
