import { type } from "arktype";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withContentKeys } from "../content-keys";
import { defineGenComponent } from "../define";

export default defineGenComponent({
  name: "cardGrid",
  description:
    "A grid of cards, one per item, each with a title, a short description, optional tags, and an optional link. Use it to present options, projects, or libraries side by side.",
  schema: type({
    cards: type({
      title: "string",
      "description?": "string",
      "tags?": type("string").array().atMostLength(5),
      "href?": "string",
    })
      .array()
      .atLeastLength(1)
      .atMostLength(12),
  }),
  render: ({ cards }) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
      {withContentKeys(cards, (card) => card.title).map(({ key, item: card }) => (
        <Card key={key} size="sm">
          <CardHeader>
            <CardTitle>
              {card.href?.startsWith("https://") ? (
                <a href={card.href} target="_blank" rel="noreferrer" className="hover:underline">
                  {card.title}
                </a>
              ) : (
                card.title
              )}
            </CardTitle>
            {card.description && <CardDescription>{card.description}</CardDescription>}
          </CardHeader>
          {card.tags && card.tags.length > 0 && (
            <CardContent className="flex flex-wrap gap-1">
              {card.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  ),
});
