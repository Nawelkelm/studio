"use client"

import { useState } from "react"
import { useForm, type SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { suggestPricing, type SuggestPricingOutput } from "@/ai/flows/suggest-pricing"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sparkles, Bot } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const aiPricingSchema = z.object({
  productDescription: z.string().min(10, "Please provide a more detailed description.").max(500),
  materialUsed: z.string().min(2, "Material is required.").max(50),
  printingTime: z.coerce.number().min(0.1, "Printing time must be at least 0.1 hours."),
})

type AiPricingFormValues = z.infer<typeof aiPricingSchema>

export default function AiPricingAssistant() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SuggestPricingOutput | null>(null)
  const { toast } = useToast()

  const form = useForm<AiPricingFormValues>({
    resolver: zodResolver(aiPricingSchema),
    defaultValues: {
      productDescription: "",
      materialUsed: "PLA",
      printingTime: 1,
    },
  })

  const onSubmit: SubmitHandler<AiPricingFormValues> = async (data) => {
    setIsLoading(true)
    setResult(null)
    try {
      const response = await suggestPricing({
        ...data,
        printingTime: `${data.printingTime} hours`,
      })
      setResult(response)
    } catch (error) {
      console.error("AI Pricing Assistant Error:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to get a suggestion from the AI. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI Pricing Assistant</CardTitle>
        <CardDescription>
          Get an AI-powered price suggestion based on your product details.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="productDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., A detailed miniature of a fantasy castle" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="materialUsed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material Used</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., PLA, ABS, PETG" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="printingTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Printing Time (hours)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="bg-accent hover:bg-accent/90">
              <Sparkles className="mr-2 h-4 w-4" />
              {isLoading ? "Getting Suggestion..." : "Get Suggestion"}
            </Button>
          </CardFooter>
        </form>
      </Form>
      
      {(isLoading || result) && (
        <CardContent>
          {isLoading && <SuggestionSkeleton />}
          {result && !isLoading && (
            <Card className="bg-secondary/50 border-accent">
              <CardHeader className="flex flex-row items-start gap-4">
                <Bot className="h-8 w-8 text-accent shrink-0 mt-1"/>
                <div>
                  <CardTitle>AI Suggestion</CardTitle>
                  <CardDescription>
                    Based on the information provided, here's a pricing suggestion.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Suggested Price</p>
                  <p className="text-3xl font-bold text-accent">{result.suggestedPrice}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reasoning</p>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{result.reasoning}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function SuggestionSkeleton() {
  return (
    <Card className="bg-secondary/50">
      <CardHeader className="flex flex-row items-start gap-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-4 w-3/4 mt-2" />
        </div>
      </CardContent>
    </Card>
  )
}
